// CAST: フィールドの人の 4 方向 × 3 コマ（立ち・右足・左足）の仮の絵（design/art_proto/ui/art_chars.js から移した。MODERN_UI §8.6）。
// 戦闘と同じ見た目のデータ（rig.fromLook）から、見下ろしの夜の光（左上の月の青い縁＋ランタンの暖色）で描く。全高 約 44 × scale。
//   R.Art.rig.field.build(B, L, dir, frame, {lantern}) → {lantern:[x,y]?, head:[x,y]}   dir = 'down'|'up'|'right'（左は右を反転して焼く）
(function (R) {
  'use strict';
  const rig = (R.Art = R.Art || {}).rig = (R.Art.rig || {});
  const FD = (rig.field = rig.field || {});

  FD.build = function (B, L, dir, frame, o) {
    o = o || {};
    const MM = rig.M();
    const side = dir === 'right';
    const back = dir === 'up';
    const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
    const bob = frame === 0 ? 0 : -0.8;
    const skin = L.skin, hair = L.hair, top = L.top, pants = L.pants || top, boots = L.boots || MM.leather, trim = L.trim || top, belt = L.belt || trim;
    const Y = (y) => y + bob;
    const hs = L.fieldHead || (L.headScale ? L.headScale / 0.88 : 1);
    const bw = L.bw || 1;
    const lk = L.legK || 1;
    const robe = L.robe || (L.skirt && L.skirt.hem > 9);
    let lant = null, head;
    // 小さい人は脚を短く（全体を下へ詰める）
    const dy = (1 - lk) * 9;
    const U = (y) => Y(y) + (y < -12 ? dy : 0);
    if (!side) {
      [-1, 1].forEach((s) => {
        const lift = step * s > 0 ? -1.6 : 0;
        B.cap(s * 2.8 * bw, U(-12), s * 2.9 * bw, Y(-3 + lift), 2.5 * bw, 2.3 * bw, pants, 2);
        B.ell(s * 3 * bw, -2 + lift * 0.6, 2.9, 2.1, boots, 2.2, { bulge: 0.8 });
      });
      if (L.cape) {
        if (back) B.poly([[-7.5 * bw, U(-24)], [7.5 * bw, U(-24)], [9.5 * bw, Y(-6 + (L.capeLong ? 3 : 0))], [0, Y(-4.5)], [-9.5 * bw, Y(-6 + (L.capeLong ? 3 : 0))]], L.cape, 5.5, { bevel: 2.5 });
        else B.poly([[-7.5 * bw, U(-23)], [7.5 * bw, U(-23)], [9.2 * bw, Y(-7)], [-9.2 * bw, Y(-7)]], L.cape, 0.5, { bevel: 2 });
      }
      B.ell(0, U(-17.5), 6.8 * bw, 7.2, top, 3, { bulge: 0.85 });
      if (robe) B.poly([[-6.5 * bw, U(-15)], [6.5 * bw, U(-15)], [8 * bw, Y(-4)], [-8 * bw, Y(-4)]], L.skirtM || top, 3.05, { bevel: 2 });
      if (L.armor === 'plate' && !back) B.ell(0, U(-18.5), 6.2 * bw, 5.6, L.metal, 3.1, { bulge: 0.7 });
      B.rect(-6.2 * bw, U(-13.2), 12.4 * bw, 2.2, belt, 3.2);
      if (!back) B.ell(0, U(-23), 3.8, 1.5, L.scarf || trim, 3.3, { bulge: 0.4 });
      if (L.scarf && back) B.ell(0, U(-23.5), 4.6, 2, L.scarf, 5.6, { bulge: 0.4 });
      [-1, 1].forEach((s) => {
        const sw = -step * s * 1.4;
        B.cap(s * 6.9 * bw, U(-21.5), s * 7.8 * bw, U(-14 + sw), 2.3, 2.0, L.sleeve || top, 3.6);
        B.ell(s * 7.9 * bw, U(-12.6 + sw), 1.9, 1.9, back ? top : skin, 3.7);
      });
      const hy = U(-31.5);
      head = [0, hy];
      B.ell(0, hy, 9.4 * hs, 8.8 * hs, skin, 6, { bulge: 0.9 });
      if (L.hairStyle !== 'bald' || back) {
        if (back) {
          B.ell(0, hy - 1.2, 10.2 * hs, 9.6 * hs, hair, 7, { bulge: 0.9 });
          if (L.hairStyle === 'bald') B.ell(0, hy - 5.5 * hs, 7.4 * hs, 4.6 * hs, skin, 7.05, { bulge: 0.8 });
          if (L.hairStyle !== 'bald') hairBack(B, L, hy, hs);
        } else {
          B.ell(0, hy - 1.4, 10.4 * hs, 9.4 * hs, hair, 5.5, { bulge: 0.9 });
          B.ell(0, hy - 5.4 * hs, 9.6 * hs, 5 * hs, hair, 7, { bulge: 0.7 });
          const longSide = ['long', 'bob', 'wave', 'curly'].includes(L.hairStyle);
          [-1, 1].forEach((s) => B.cap(s * 8.2 * hs, hy - 5 * hs, s * 8.8 * hs, hy + (longSide ? 5.5 : 2.5) * hs, 2.6 * hs, 1.8 * hs, hair, 7.1));
          hairFront(B, L, hy, hs);
        }
      }
      if (!back) {
        [-1, 1].forEach((s) => {
          B.ell(s * 3.4 * hs, hy + 1.6 * hs, 1.25, 1.75, L.eye || MM.lash, 7.5, { bulge: 0.2 });
          B.rect(s * 3.4 * hs - 0.3, hy + 0.4 * hs, 0.8, 0.8, MM.white, 7.6);
        });
        if (!L.old) { B.ell(-5.6 * hs, hy + 4 * hs, 1.3, 0.7, MM.blush, 7.4, { bulge: 0.1 }); B.ell(5.6 * hs, hy + 4 * hs, 1.3, 0.7, MM.blush, 7.4, { bulge: 0.1 }); }
        if ((L.extras || []).includes('beard')) B.ell(0, hy + 6.5 * hs, 5.5 * hs, 3.4 * hs, L.beardM || hair, 7.45, { bulge: 0.6 });
      }
      hat(B, L, hy, hs, back ? 'back' : 'front');
      if (o.lantern) { lant = [8.2 * bw, U(-9.6) + 2.5]; lantern(B, 8.2 * bw, U(-9.6), back ? 1 : 8); }
    } else {
      const legA = [step * 3.2, -step * 3.2];
      [[-1, legA[1], 1.8], [1, legA[0], 2.4]].forEach(([s, dx, z]) => {
        B.cap(0.5, U(-12), dx * 0.7 + 0.5, Y(-3 - Math.abs(dx) * 0.15), 2.5 * bw, 2.3 * bw, pants, z);
        B.ell(dx * 0.8 + 1.8, -2 - (Math.abs(dx) > 1 && dx < 0 ? 0.8 : 0), 3.3, 2.0, boots, z + 0.1, { bulge: 0.8 });
      });
      if (L.cape) B.poly([[-5.5, U(-23)], [-1, U(-23.5)], [-2.5, Y(-6)], [-9.5 - Math.abs(step), Y(-5.5 + (L.capeLong ? 3 : 0))]], L.cape, 1.2, { bevel: 2 });
      if (L.scarf) B.cap(-1, U(-23), -8 - Math.abs(step), U(-18), 1.6, 0.8, L.scarf, 1.3);
      B.cap(0.5, U(-21), -step * 2.6 + 0.5, U(-14), 2.1, 1.9, L.sleeve || top, 1.5);
      B.ell(0, U(-17.5), 5.4 * bw, 7.2, top, 3, { bulge: 0.85 });
      if (robe) B.poly([[-5.2 * bw, U(-15)], [5.2 * bw, U(-15)], [6.4 * bw, Y(-4)], [-6.4 * bw, Y(-4)]], L.skirtM || top, 3.05, { bevel: 2 });
      B.rect(-5 * bw, U(-13.2), 10.2 * bw, 2.2, belt, 3.2);
      if (L.scarf) B.ell(1, U(-23), 4, 1.8, L.scarf, 5.7, { bulge: 0.4 });
      B.cap(0.5, U(-21), step * 2.8 + 1, U(-14), 2.3, 2.0, L.sleeve || top, 5.8);
      B.ell(step * 2.9 + 1.2, U(-12.6), 1.9, 1.9, skin, 5.9);
      const hy = U(-31.5);
      head = [1, hy];
      B.ell(1, hy, 8.8 * hs, 8.8 * hs, skin, 6, { bulge: 0.9 });
      if (L.hairStyle !== 'bald') {
        B.ell(-3.6 * hs, hy - 1.2, 7.4 * hs, 9.2 * hs, hair, 7, { bulge: 0.9 });
        B.ell(1.4, hy - 5.4 * hs, 8.8 * hs, 4.6 * hs, hair, 7.05, { bulge: 0.7 });
        B.cap(-0.6 * hs, hy - 4 * hs, -1.4 * hs, hy + 4 * hs, 2.6 * hs, 1.9 * hs, hair, 7.1);
        hairSide(B, L, hy, hs);
      } else { B.ell(-3.6 * hs, hy + 1.5, 6.4 * hs, 6.2 * hs, hair, 7, { bulge: 0.9 }); B.ell(-1 * hs, hy + 0.8, 1.4, 2, skin, 7.05, { bulge: 0.5 }); }
      B.ell(5.6 * hs, hy + 1.6 * hs, 1.2, 1.75, L.eye || MM.lash, 7.5, { bulge: 0.2 });
      B.rect(5.4 * hs, hy + 0.4 * hs, 0.8, 0.8, MM.white, 7.6);
      if (!L.old) B.ell(6.4 * hs, hy + 4.2 * hs, 1.2, 0.7, MM.blush, 7.4, { bulge: 0.1 });
      if ((L.extras || []).includes('beard')) B.ell(5 * hs, hy + 6 * hs, 3.6 * hs, 3 * hs, L.beardM || hair, 7.45, { bulge: 0.6 });
      hat(B, L, hy, hs, 'side');
      if (o.lantern) { lant = [step * 2.9 + 3, U(-10) + 2.5]; lantern(B, step * 2.9 + 3, U(-10), 8); }
    }
    return { lantern: lant, head };
  };

  function hairFront(B, L, hy, hs) {
    const H = L.hair, st = L.hairStyle;
    if (st === 'spiky' || st === 'wild') for (let i = -2; i <= 2; i++) B.cap(i * 3.4 * hs, hy - 7 * hs, i * 5.6 * hs + (i === 0 ? 1.5 : 0), hy - 10.5 * hs - (2 - Math.abs(i)) * 0.8, 2.6 * hs, 0.8, H, 7.2);
    if (st === 'braid') { B.cap(-8.5 * hs, hy + 2, -9.2 * hs, hy + 12, 2.2, 1.6, H, 7.2); B.ell(-9.2 * hs, hy + 13, 1.6, 1.4, L.trim || H, 7.3); }
    if (st === 'pigtails') [-1, 1].forEach((s) => { B.cap(s * 9.5 * hs, hy - 2, s * 11 * hs, hy + 9, 2.4, 1.4, H, 5.4); B.ell(s * 9.4 * hs, hy - 2.5, 1.5, 1.5, L.trim, 7.3); });
    if (st === 'long' || st === 'wave') [-1, 1].forEach((s) => B.cap(s * 8.6 * hs, hy + 2, s * 9.4 * hs, hy + 13, 2.8, 2.2, H, 5.4));
    if (st === 'bun') B.ell(0, hy - 10.5 * hs, 4.2 * hs, 3.6 * hs, H, 7.25, { bulge: 0.8 });
    if (st === 'ponytail' || st === 'tail') B.ell(0, hy - 9.6 * hs, 3 * hs, 2.4 * hs, H, 7.25, { bulge: 0.7 });
    if (st === 'curly') for (let i = -2; i <= 2; i++) B.ell(i * 4 * hs, hy - 8.5 * hs + Math.abs(i) * 1.6, 3 * hs, 2.6 * hs, H, 7.22, { bulge: 0.8 });
    if (st === 'swept') B.cap(-7 * hs, hy - 8 * hs, 7 * hs, hy - 10 * hs, 2.8 * hs, 2.2 * hs, H, 7.2);
  }
  function hairBack(B, L, hy, hs) {
    const H = L.hair, st = L.hairStyle;
    if (st === 'spiky' || st === 'wild') for (let i = -2; i <= 2; i++) B.cap(i * 3.2 * hs, hy - 8 * hs, i * 4.6 * hs, hy - 12.5 * hs - (2 - Math.abs(i)) * 1.2, 2.2 * hs, 0.6, H, 7.2);
    if (st === 'braid') B.cap(0, hy + 6, 0.5, hy + 17, 2.4, 1.6, H, 7.2);
    if (st === 'ponytail') B.cap(0, hy - 4, 0.6, hy + 12, 2.8, 1.4, H, 7.2);
    if (st === 'tail') { B.ell(0, hy - 7, 3, 2.6, H, 7.25); B.cap(0, hy - 6, 0.3, hy + 4, 1.8, 0.9, H, 7.2); }
    if (st === 'pigtails') [-1, 1].forEach((s) => B.cap(s * 9 * hs, hy, s * 10.5 * hs, hy + 10, 2.4, 1.4, H, 7.2));
    if (st === 'long' || st === 'wave') B.poly([[-9, hy], [9, hy], [8, hy + 13], [-8, hy + 13]], H, 7.1, { bevel: 2 });
    if (st === 'bob' || st === 'curly') B.ell(0, hy + 3, 10 * hs, 5, H, 7.1, { bulge: 0.8 });
    if (st === 'bun') B.ell(0, hy - 7 * hs, 4.4 * hs, 3.8 * hs, H, 7.3, { bulge: 0.8 });
  }
  function hairSide(B, L, hy, hs) {
    const H = L.hair, st = L.hairStyle;
    if (st === 'spiky' || st === 'wild') for (let i = 0; i < 4; i++) B.cap(-2 - i * 2.6, hy - 8 + i * 1.5, -6 - i * 3.2, hy - 12 + i * 3, 2.2, 0.6, H, 7.2);
    if (st === 'braid') B.cap(-6, hy + 3, -7.5, hy + 15, 2.3, 1.6, H, 7.2);
    if (st === 'ponytail') B.cap(-7, hy - 5, -10, hy + 9, 2.6, 1.2, H, 7.2);
    if (st === 'tail') { B.ell(-6.5, hy - 6, 2.8, 2.4, H, 7.25); B.cap(-8, hy - 6, -12, hy - 1, 1.8, 0.9, H, 7.2); }
    if (st === 'pigtails') B.cap(-7, hy - 1, -9.5, hy + 9, 2.4, 1.4, H, 7.2);
    if (st === 'long' || st === 'wave') B.poly([[-9.5, hy - 2], [-2, hy - 2], [-3.5, hy + 13], [-10, hy + 12]], H, 5.3, { bevel: 2 });
    if (st === 'bob' || st === 'curly') B.ell(-3, hy + 3, 7, 5, H, 7.1, { bulge: 0.8 });
    if (st === 'bun') B.ell(-5.5 * hs, hy - 7 * hs, 4 * hs, 3.6 * hs, H, 7.3, { bulge: 0.8 });
  }
  /** かぶり物（見下ろしの 3 面） */
  function hat(B, L, hy, hs, face) {
    const t = L.headwear;
    if (!t) return;
    const MM = rig.M();
    const m = L.hwM || L.cape || L.trim;
    const sx = face === 'side' ? 1 : 0;
    if (t === 'hood') {
      B.ell(sx * -1.5, hy - 2 * hs, 11.2 * hs, 9.4 * hs, m, 7.3, { bulge: 0.8 });
      if (face !== 'back') B.ell(sx * 3.6, hy + 1.8 * hs, (face === 'side' ? 6 : 7.6) * hs, 6 * hs, L.skin, 7.35, { bulge: 0.6 });
    } else if (t === 'veil') {
      B.ell(sx * -1.5, hy - 3 * hs, 10.8 * hs, 7.8 * hs, m, 7.3, { bulge: 0.8 });
      if (face !== 'back') B.ell(sx * 3.6, hy + 1.4 * hs, (face === 'side' ? 6 : 7.4) * hs, 6.4 * hs, L.skin, 7.35, { bulge: 0.6 });
    } else if (t === 'helm' || t === 'plume' || t === 'kettle') {
      B.ell(sx * 0.5, hy - 4.6 * hs, 10.4 * hs, 6.6 * hs, L.metal || MM.iron, 7.4, { bulge: 0.8 });
      if (t === 'kettle') B.ell(sx * 0.5, hy - 2.6 * hs, 13.5 * hs, 3 * hs, L.metal || MM.iron, 7.35, { bulge: 0.4 });
      if (t === 'plume') B.cap(sx * -2, hy - 10 * hs, sx * -9 + (face === 'side' ? 0 : 0), hy - 15 * hs, 2.2, 1, m, 7.45);
    } else if (t === 'wide' || t === 'straw' || t === 'pointed') {
      B.ell(sx * 0.5, hy - 4.2 * hs, 15 * hs, 4.4 * hs, m, 7.4, { bulge: 0.5 });
      if (t === 'pointed') B.poly([[-6 * hs, hy - 6 * hs], [6 * hs, hy - 6 * hs], [(sx ? -5 : 2) * hs, hy - 20 * hs]], m, 7.45, { bevel: 1.5 });
      else B.ell(sx * 0.3, hy - 7.5 * hs, 8.4 * hs, 4.6 * hs, m, 7.45, { bulge: 0.7 });
    } else if (t === 'beret' || t === 'cap' || t === 'feather') {
      B.ell(sx * -1, hy - 7.2 * hs, 9.8 * hs, 4.4 * hs, m, 7.4, { bulge: 0.7 });
      if (t === 'feather') B.ell(sx * -4 - 5, hy - 10 * hs, 4.2, 1.3, L.trim, 7.45, { rot: -0.5, bulge: 0.4 });
    } else if (t === 'circlet') {
      B.cap(-8 * hs, hy - 4.6 * hs, 8 * hs, hy - 4.6 * hs, 0.7, 0.7, MM.gold, 7.3);
    } else if (t === 'headband' || t === 'bandana') {
      B.cap(-9 * hs, hy - 4.6 * hs, 9 * hs, hy - 4.6 * hs, 1.2, 1.2, m, 7.3);
      if (t === 'bandana') B.ell(0, hy - 7 * hs, 9.2 * hs, 4 * hs, m, 7.28, { bulge: 0.6 });
    } else if (t === 'goggles' && face !== 'back') {
      [-1, 1].forEach((s) => B.ell(s * 3.6 * hs + sx * 3, hy - 5.4 * hs, 2.2, 1.8, MM.glass, 7.35, { bulge: 0.4 }));
    }
  }
  /** ランタン（先頭の人の手。発光の素材） */
  function lantern(B, x, y, z) {
    const MM = rig.M();
    B.cap(x, y - 3.5, x, y - 1.5, 0.45, 0.45, MM.iron, z);
    B.poly([[x - 2.4, y], [x + 2.4, y], [x + 2.4, y + 5], [x - 2.4, y + 5]], MM.lantern, z + 0.1, { bevel: 0.3 });
    B.poly([[x - 3, y - 0.3], [x + 3, y - 0.3], [x + 1.4, y - 1.8], [x - 1.4, y - 1.8]], MM.iron, z + 0.2, { bevel: 0.6 });
    B.rect(x - 3, y + 5, 6, 1.1, MM.iron, z + 0.2);
  }
  FD.lantern = lantern;
})(window.RPG);
