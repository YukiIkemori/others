// Field (top-down) character sprites in 4 directions × 3 walk frames, drawn with the same 2.5D
// rasterizer and the same look data as the battle cast (so a member reads as the same person).
// ~44 art px tall (1.4 tiles of 32 art px). MODERN_UI.md §8.6.
'use strict';
(function (G) {
  const { mat, hex } = G.RZ;
  const STYLE = { tones: 5, sat: 0.92, olMix: 0.82 };
  // top-down night light: moon from the upper left (cold rim), warm fill from the carried lantern
  const FL = { key: [-0.45, -0.55, 0.7], rim: [0.6, -0.5, -0.6], rimC: hex('#9fc0ff'), rimK: 0.9, mul: [0.98, 0.9, 0.82] };
  G.FIELD_LIGHT = FL;

  // dir: 'down' | 'up' | 'right' | 'left'; frame 0 = stand, 1 / 2 = steps
  function build(B, L, dir, frame, o) {
    o = o || {};
    const side = dir === 'right' || dir === 'left';
    const back = dir === 'up';
    const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
    const bob = frame === 0 ? 0 : -0.8;
    const skin = L.skin, hair = L.hair, top = L.top, pants = L.pants || top, boots = L.boots, trim = L.trim || top, belt = L.belt || trim;
    const Y = (y) => y + bob;
    const hs = L.fieldHead || 1;
    if (!side) {
      // legs
      [-1, 1].forEach((s) => {
        const lift = step * s > 0 ? -1.6 : 0;
        B.cap(s * 2.8, Y(-12), s * 2.9, Y(-3 + lift), 2.5, 2.3, pants, 2);
        B.ell(s * 3, -2 + lift * 0.6, 2.9, 2.1, boots, 2.2, { bulge: 0.8 });
      });
      // cape behind (front view: peeks out at the sides; back view: covers the back)
      if (L.cape) {
        if (back) B.poly([[-7.5, Y(-24)], [7.5, Y(-24)], [9.5, Y(-6)], [0, Y(-4.5)], [-9.5, Y(-6)]], L.cape, 5.5, { bevel: 2.5 });
        else B.poly([[-7.5, Y(-23)], [7.5, Y(-23)], [9.2, Y(-7)], [-9.2, Y(-7)]], L.cape, 0.5, { bevel: 2 });
      }
      // torso / skirt
      B.ell(0, Y(-17.5), 6.8, 7.2, top, 3, { bulge: 0.85 });
      if (L.robe) B.poly([[-6.5, Y(-15)], [6.5, Y(-15)], [8, Y(-5)], [-8, Y(-5)]], top, 3.05, { bevel: 2 });
      B.rect(-6.2, Y(-13.2), 12.4, 2.2, belt, 3.2);
      if (!back) B.ell(0, Y(-23), 3.8, 1.5, trim, 3.3, { bulge: 0.4 });
      // arms (swing opposite to legs)
      [-1, 1].forEach((s) => {
        const sw = -step * s * 1.4;
        B.cap(s * 6.9, Y(-21.5), s * 7.8, Y(-14 + sw), 2.3, 2.0, top, 3.6);
        B.ell(s * 7.9, Y(-12.6 + sw), 1.9, 1.9, back ? top : skin, 3.7);
      });
      // head
      const hy = Y(-31.5);
      B.ell(0, hy, 9.4 * hs, 8.8 * hs, skin, 6, { bulge: 0.9 });
      if (back) {
        B.ell(0, hy - 1.2, 10.2 * hs, 9.6 * hs, hair, 7, { bulge: 0.9 });
        hairBack(B, L, hy, hs);
      } else {
        // hair shell behind the head (sides) + bangs + side locks
        B.ell(0, hy - 1.4, 10.4 * hs, 9.4 * hs, hair, 5.5, { bulge: 0.9 });
        B.ell(0, hy - 5.4 * hs, 9.6 * hs, 5 * hs, hair, 7, { bulge: 0.7 });
        [-1, 1].forEach((s) => B.cap(s * 8.2 * hs, hy - 5 * hs, s * 8.8 * hs, hy + (L.hairStyle === 'long' || L.hairStyle === 'bob' ? 5.5 : 2.5) * hs, 2.6 * hs, 1.8 * hs, hair, 7.1));
        hairFront(B, L, hy, hs);
        // eyes
        [-1, 1].forEach((s) => {
          B.ell(s * 3.4 * hs, hy + 1.6 * hs, 1.25, 1.75, L.eye || G.RIG.M.lash, 7.5, { bulge: 0.2 });
          B.rect(s * 3.4 * hs - 0.3 - (s < 0 ? 0 : 0), hy + 0.4 * hs, 0.8, 0.8, G.RIG.M.white, 7.6);
        });
        B.ell(-5.6 * hs, hy + 4 * hs, 1.3, 0.7, G.RIG.M.blush, 7.4, { bulge: 0.1 });
        B.ell(5.6 * hs, hy + 4 * hs, 1.3, 0.7, G.RIG.M.blush, 7.4, { bulge: 0.1 });
      }
      if (o.lantern && !back) lantern(B, 8.2, Y(-9.6), 8);
      if (o.lantern && back) lantern(B, 8.2, Y(-9.6), 1);
      if (L.weaponBack && back) B.cap(-5, Y(-28), 6, Y(-8), 1.2, 1.1, G.RIG.M.wood, 6.6);
    } else {
      // side view (right); left is the same render flipped
      const legA = [step * 3.2, -step * 3.2];
      [[-1, legA[1], 1.8], [1, legA[0], 2.4]].forEach(([s, dx, z]) => {
        B.cap(0.5, Y(-12), dx * 0.7 + 0.5, Y(-3 - Math.abs(dx) * 0.15), 2.5, 2.3, pants, z);
        B.ell(dx * 0.8 + 1.8, -2 - (Math.abs(dx) > 1 && dx < 0 ? 0.8 : 0), 3.3, 2.0, boots, z + 0.1, { bulge: 0.8 });
      });
      if (L.cape) B.poly([[-5.5, Y(-23)], [-1, Y(-23.5)], [-2.5, Y(-6)], [-9.5 - Math.abs(step), Y(-5.5)]], L.cape, 1.2, { bevel: 2 });
      // far arm
      B.cap(0.5, Y(-21), -step * 2.6 + 0.5, Y(-14), 2.1, 1.9, top, 1.5);
      B.ell(0, Y(-17.5), 5.4, 7.2, top, 3, { bulge: 0.85 });
      if (L.robe) B.poly([[-5.2, Y(-15)], [5.2, Y(-15)], [6.4, Y(-5)], [-6.4, Y(-5)]], top, 3.05, { bevel: 2 });
      B.rect(-5, Y(-13.2), 10.2, 2.2, belt, 3.2);
      // near arm
      B.cap(0.5, Y(-21), step * 2.8 + 1, Y(-14), 2.3, 2.0, top, 5.8);
      B.ell(step * 2.9 + 1.2, Y(-12.6), 1.9, 1.9, skin, 5.9);
      const hy = Y(-31.5);
      B.ell(1, hy, 8.8 * hs, 8.8 * hs, skin, 6, { bulge: 0.9 });
      B.ell(-3.6 * hs, hy - 1.2, 7.4 * hs, 9.2 * hs, hair, 7, { bulge: 0.9 });
      B.ell(1.4, hy - 5.4 * hs, 8.8 * hs, 4.6 * hs, hair, 7.05, { bulge: 0.7 });
      B.cap(-0.6 * hs, hy - 4 * hs, -1.4 * hs, hy + 4 * hs, 2.6 * hs, 1.9 * hs, hair, 7.1); // sideburn over the ear
      hairSide(B, L, hy, hs);
      B.ell(5.6 * hs, hy + 1.6 * hs, 1.2, 1.75, L.eye || G.RIG.M.lash, 7.5, { bulge: 0.2 });
      B.rect(5.4 * hs, hy + 0.4 * hs, 0.8, 0.8, G.RIG.M.white, 7.6);
      B.ell(6.4 * hs, hy + 4.2 * hs, 1.2, 0.7, G.RIG.M.blush, 7.4, { bulge: 0.1 });
      if (o.lantern) lantern(B, step * 2.9 + 3, Y(-10), 8);
    }
  }
  function hairFront(B, L, hy, hs) {
    const H = L.hair;
    if (L.hairStyle === 'spiky') for (let i = -2; i <= 2; i++) B.cap(i * 3.4 * hs, hy - 7 * hs, i * 5.6 * hs + (i === 0 ? 1.5 : 0), hy - 10.5 * hs - (2 - Math.abs(i)) * 0.8, 2.6 * hs, 0.8, H, 7.2);
    if (L.hairStyle === 'braid') { B.cap(-8.5 * hs, hy + 2, -9.2 * hs, hy + 12, 2.2, 1.6, H, 7.2); B.ell(-9.2 * hs, hy + 13, 1.6, 1.4, L.trim || H, 7.3); }
    if (L.hairStyle === 'long') [-1, 1].forEach((s) => B.cap(s * 8.6 * hs, hy + 2, s * 9.4 * hs, hy + 13, 2.8, 2.2, H, 5.4));
    if (L.hood) B.ell(0, hy - 3 * hs, 11.2 * hs, 8.6 * hs, L.cape || H, 7.3, { bulge: 0.8 }), B.ell(0, hy + 1.8 * hs, 7.6 * hs, 6 * hs, L.skin, 7.35, { bulge: 0.6 });
    if (L.circlet) B.cap(-6 * hs, hy - 5.5 * hs, 6 * hs, hy - 5.5 * hs, 0.7, 0.7, G.RIG.M.gold, 7.3);
  }
  function hairBack(B, L, hy, hs) {
    const H = L.hair;
    if (L.hairStyle === 'spiky') for (let i = -2; i <= 2; i++) B.cap(i * 3.2 * hs, hy - 8 * hs, i * 4.6 * hs, hy - 12.5 * hs - (2 - Math.abs(i)) * 1.2, 2.2 * hs, 0.6, H, 7.2);
    if (L.hairStyle === 'braid') B.cap(0, hy + 6, 0.5, hy + 17, 2.4, 1.6, H, 7.2);
    if (L.hairStyle === 'long') B.poly([[-9, hy], [9, hy], [8, hy + 13], [-8, hy + 13]], H, 7.1, { bevel: 2 });
    if (L.hairStyle === 'bob') B.ell(0, hy + 3, 10 * hs, 5, H, 7.1, { bulge: 0.8 });
    if (L.hood) B.ell(0, hy - 1 * hs, 11.2 * hs, 10 * hs, L.cape || H, 7.6, { bulge: 0.8 });
  }
  function hairSide(B, L, hy, hs) {
    const H = L.hair;
    if (L.hairStyle === 'spiky') for (let i = 0; i < 4; i++) B.cap(-2 - i * 2.6, hy - 8 + i * 1.5, -6 - i * 3.2, hy - 12 + i * 3, 2.2, 0.6, H, 7.2);
    if (L.hairStyle === 'braid') B.cap(-6, hy + 3, -7.5, hy + 15, 2.3, 1.6, H, 7.2);
    if (L.hairStyle === 'long') B.poly([[-9.5, hy - 2], [-2, hy - 2], [-3.5, hy + 13], [-10, hy + 12]], H, 5.3, { bevel: 2 });
    if (L.hairStyle === 'bob') B.ell(-3, hy + 3, 7, 5, H, 7.1, { bulge: 0.8 });
    if (L.hood) B.ell(-1.5, hy - 1.5, 10.5 * hs, 10 * hs, L.cape || H, 7.3, { bulge: 0.8 }), B.ell(3.6, hy + 1.2, 6, 6.5, L.skin, 7.35, { bulge: 0.6 });
  }
  const LANT = mat({ keys: ['#b04808', '#f08a28', '#ffc868', '#fff0b8'], n: 4, flat: true, glow: '#ffd070' });
  function lantern(B, x, y, z) {
    const iron = G.RIG.M.iron;
    B.cap(x, y - 3.5, x, y - 1.5, 0.45, 0.45, iron, z);
    B.poly([[x - 2.4, y], [x + 2.4, y], [x + 2.4, y + 5], [x - 2.4, y + 5]], LANT, z + 0.1, { bevel: 0.3 });
    B.poly([[x - 3, y - 0.3], [x + 3, y - 0.3], [x + 1.4, y - 1.8], [x - 1.4, y - 1.8]], iron, z + 0.2, { bevel: 0.6 });
    B.rect(x - 3, y + 5, 6, 1.1, iron, z + 0.2);
  }

  const cache = {};
  function sprite(L, dir, frame, o) {
    o = o || {};
    const key = (L.name || 'x') + dir + frame + (o.lantern ? 'L' : '') + (o.scale || 1.15);
    if (cache[key]) return cache[key];
    const B = new RZ.Builder();
    build(B, L, dir === 'left' ? 'right' : dir, frame, o);
    const r = RZ.render(B, Object.assign({}, STYLE, { flip: dir === 'left', scale: o.scale || 1.15, light: FL }));
    return (cache[key] = r);
  }
  G.FIELD_CHAR = { sprite, build, FL };
})(window);
