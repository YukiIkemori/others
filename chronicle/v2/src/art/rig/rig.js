// CAST: 仮の絵の骨組み（design/art_proto/code/rig.js から移した。V2_PLAN §1.2・§2.2）。原画（A34・A35）が届くまでの**仮の絵**。
// 2.7 頭身の人の骨組み。モデルの単位 = scale 1 の画素、原点は両足の間、**右向き**（戦闘は焼くときに反転して左向き）。
// 骨の角度から毎回 2.5D の部品を組むので、どのポーズ・間のコマ（tween）も同じ骨組みで作れる。見た目はデータ（R.Art.rig.fromLook）。
//   const B = new R.Hd.RZ.Builder(); const pt = R.Art.rig.draw(B, L, R.Art.rig.pose('slash')); R.Hd.RZ.render(B, {...})
//   → pt = {hand, head, dy, lantern?}（モデル座標、足元 = 0）
// 髪・かぶり物・武器は hair.js・headwear.js・weapons.js（ここからは関数の中でだけ呼ぶ）。
(function (R) {
  'use strict';
  const Art = (R.Art = R.Art || {});
  const rig = (Art.rig = Art.rig || {});
  const PI = Math.PI;

  // ---------- 素材（段は暗い → 明るい、影は寒色・光は暖色へずらす）。初めて使うときに作る（R.Hd.RZ は render の後に読まれる）
  let M = null;
  rig.M = function () {
    if (M) return M;
    const { mat } = R.Hd.RZ;
    M = {
      skin: mat({ keys: ['#46282a', '#84523f', '#bb866a', '#deb496', '#f4d8c0'], n: 6, rim: '#fff0d8', wrap: 0.45, amb: 0.3 }),
      white: mat({ keys: ['#f4f2ee', '#fbfaf6'], n: 2, flat: true }),
      lash: mat({ keys: ['#1a0e14', '#2c1820'], n: 2, flat: true }),
      mouth: mat({ keys: ['#6e2a2c', '#9a4446'], n: 2, flat: true }),
      blush: mat({ keys: ['#d88070', '#d88070'], n: 2, flat: true }),
      steel: mat({ keys: ['#22262e', '#454c58', '#727a86', '#a4acb4', '#dce0e2'], n: 6, metal: true, spec: 1, specPow: 10, rim: '#ffe8c0' }),
      gold: mat({ keys: ['#2e2010', '#5e4424', '#8e7040', '#bca068', '#e8d8a8'], n: 6, metal: true, spec: 1, specPow: 10 }),
      iron: mat({ keys: ['#1a1c24', '#3a404c', '#646c7a', '#9ca4b0', '#d2d8de'], n: 6, metal: true, spec: 0.8, specPow: 12 }),
      leather: mat({ keys: ['#221610', '#3e2a1e', '#5c4030', '#7e5c44', '#a07e60'], n: 6, tex: 0.9, tsx: 0.8, tsy: 0.8 }),
      leatherDk: mat({ keys: ['#16100e', '#2a201a', '#40322a', '#58483c'], n: 5 }),
      wood: mat({ keys: ['#2a160c', '#5a341c', '#8c5a30', '#b8844c', '#e0b27a'], n: 6 }),
      glass: mat({ keys: ['#28323e', '#5c7084', '#a8c0d0', '#eef6fa'], n: 4, flat: true }),
      lantern: mat({ keys: ['#b04808', '#f08a28', '#ffc868', '#fff0b8'], n: 4, flat: true, glow: '#ffd070' }),
    };
    return M;
  };

  // ---------- 光（夜: ランタンの暖かいキー＋月の寒色のリム。MODERN_UI §4、プロトの NIGHT_PARTY と FIELD_LIGHT）
  rig.light = function (kind) {
    const hex = R.Hd.RZ.hex;
    if (kind === 'field') return { key: [-0.45, -0.55, 0.7], rim: [0.6, -0.5, -0.6], rimC: hex('#9fc0ff'), rimK: 0.9, mul: [0.98, 0.9, 0.82] };
    if (kind === 'face') return { key: [-0.5, -0.4, 0.78], rim: [0.7, -0.4, -0.5], rimC: hex('#a8c8ff'), rimK: 1.0, mul: [1.0, 0.9, 0.8] };
    return { key: [-0.62, -0.35, 0.7], rim: [0.5, -0.7, -0.5], rimC: hex('#a8c8ff'), rimK: 1.1, mul: [1.0, 0.86, 0.7] };
  };
  /** RZ.render の共通の値（STYLE から。数値を書き直さない） */
  rig.renderOpts = function (o) {
    const ST = R.Hd.STYLE || {};
    return Object.assign({ tones: ST.tones || 5, sat: ST.sat || 0.9, olMix: ST.olMix || 0.82 }, o);
  };

  // ---------- 描く
  const dir = (a) => [Math.sin(a), Math.cos(a)];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];

  /**
   * 骨組みを Builder に積む。L = rig.fromLook の結果、p = rig.pose(...)。opt = {noWeapon, headOnly}
   * → {hand, head, dy, neck}（モデル座標。足元が y = 0）
   */
  rig.draw = function (B, L, p, opt) {
    opt = opt || {};
    const MM = rig.M();
    const SK = L.skin || MM.skin;
    const bw = L.bw || 1;                  // 体の幅（slim 0.9・sturdy 1.15）
    const br = Math.sin(p.br * PI * 2) * 0.5;
    const piv = [0, -9], cr = Math.cos(p.rot), sr = Math.sin(p.rot);
    const Gt = (x, y) => { const dx = x - piv[0], dy = y - piv[1]; return [piv[0] + dx * cr - dy * sr + p.x, piv[1] + dx * sr + dy * cr + p.y]; };
    const out = [];
    const E = (x, y, rx, ry, m, z, o) => out.push(['e', [x, y], rx, ry, m, z, o || {}]);
    const C = (a, b, r1, r2, m, z, o) => out.push(['c', a, b, r1, r2, m, z, o || {}]);
    const Pl = (pts, m, z, o) => out.push(['p', pts, m, z, o || {}]);
    const Rc = (x, y, w, h, m, z, o) => out.push(['r', [x, y], w, h, m, z, o || {}]);
    const S = (pts, w0, w1, m, z, o) => out.push(['s', pts, w0, w1, m, z, o || {}]);
    const F = (a, b, r, tg, d) => out.push(['f', a, b, r, tg, d]);

    const legL = 7.4 * (L.legK || 1), thighR = 2.5 * bw;
    const hip = [0, -15.5 * (L.legK || 1) - br * 0.2];
    const lean = p.lean + (L.hunch || 0);
    const T = (x, y) => add(hip, rot([x * bw, y * (1 + br * 0.03)], lean));
    const neck = T(0.4, -13.5);
    const headAng = lean * 0.5 + p.tilt;
    const hc = add(neck, rot([1.2, -10.2], headAng));
    const H = (x, y) => add(hc, rot([x, y], headAng));
    const knees = []; const g = {}; const grp = (k) => (g[k] = g[k] || B.group());

    // --- 脚（奥の脚は体の後ろ、手前の脚は前）
    const pants = L.pants || L.top, boots = L.boots || MM.leather;
    const leg = (side, a, k, z) => {
      const hp = T(side * -1.6, 0.5);
      const kn = add(hp, [dir(a)[0] * legL, dir(a)[1] * legL]);
      const an = add(kn, [dir(a + k)[0] * legL, dir(a + k)[1] * legL]);
      const gp = grp('leg' + side), gb = grp('boot' + side); knees.push(kn);
      C(hp, kn, thighR, 2.1 * bw, pants, z, { g: gp });
      C(kn, an, 2.25 * bw, 2.0, boots, z + 0.05, { g: gb });
      E(kn[0] + 0.3, kn[1] + 0.8, 2.6 * bw, 1.4, boots, z + 0.06, { g: gb, rot: a + k });
      const fa = a + k;
      const fv = rot([2.4, 0.9], -Math.min(0.3, Math.max(-0.6, fa * 0.3)));
      E(an[0] + fv[0], an[1] + fv[1] + 0.2, 3.3, 1.7, boots, z + 0.04, { g: gb, rot: -fa * 0.25 });
      return an;
    };
    const aF = leg(-1, p.lF, p.kF, 2);
    const aN = leg(1, p.lN, p.kN, 4);

    // --- マント
    if (L.cape) {
      const sh = T(-3.5, -12.5), w = p.cape, long = L.capeLong ? 1 : 0;
      const pts = [T(-1, -13.8), sh, T(-8 - w * 3, -1), T(-11 - w * 5, 7 + w + long * 4), T(-5 - w * 3, 9 - w * 1.5 + long * 5), T(0, 5 + long * 4)];
      const gc = grp('cape');
      Pl(pts, L.cape, 0.5, { g: gc, bevel: 2.5, nx: -0.25 });
      F(T(-3, -8), T(-8 - w * 4, 7), 0.9, gc, -1);
      F(T(-5.5, -9), T(-10 - w * 4, 5), 0.7, gc, 1);
      F(T(-1.5, -6), T(-4 - w * 3, 8), 0.8, gc, -1);
    }

    // --- 胴
    const gt = grp('torso');
    E(T(0.3, -7.6)[0], T(0.3, -7.6)[1], 6.1 * bw, 8.2, L.top, 5, { g: gt, rot: lean });
    const skirt = L.skirt || { flare: 7.2, hem: 4.6 };
    const flare = skirt.flare, hem = skirt.hem;
    const gs = grp('skirt');
    Pl([T(-5.6, -4), T(5.6, -4), T(flare - 0.4 + p.lean * 2, hem), T(0, hem + 0.8), T(-flare - 0.6, hem - 0.4)], L.skirtM || L.top, 5.2, { g: gs, bevel: 3 });
    const gtr = grp('trim');
    C(T(-flare - 0.4, hem - 0.9), T(flare - 0.6 + p.lean * 2, hem - 0.5), 0.9, 0.9, L.trim, 5.3, { g: gtr });
    for (let i = -2; i <= 2; i++) F(T(i * 1.6, -1), T(i * (flare / 2.3), hem - 1), 0.6, gs, i % 2 ? -1 : 1);
    F(T(1.6, -12), T(3.4, -4), 0.6, gt, -1);
    if (L.robe) C(T(1.8, -13), T(2.2, hem - 1), 0.7, 0.8, L.trim, 5.35, { g: grp('robeTrim') });
    if (L.gi) { C(T(-2.6, -13), T(3.4, -5.5), 0.8, 0.8, L.trim, 5.36, { g: grp('giA') }); C(T(3.6, -13), T(-1, -6.5), 0.7, 0.7, L.trim, 5.35, { g: grp('giB') }); }
    if (L.armor === 'plate') {
      const gp = grp('plate');
      Pl([T(-5.2, -13), T(5.2, -13.2), T(6, -7), T(4.4, -2.8), T(-4.6, -2.8), T(-5.8, -7)], L.metal, 5.6, { g: gp, bevel: 3.5 });
      F(T(0.6, -12.5), T(0.8, -3.4), 0.6, gp, 1.2);
      for (let i = 0; i < 3; i++) C(T(-4.4, -4.5 + i * 2.3), T(4.4, -4.6 + i * 2.3), 1.1, 1.1, L.metal, 5.62 + i * 0.01, { g: grp('tasset' + i) });
    } else if (L.armor === 'vest') {
      Pl([T(-4.8, -12.6), T(4.8, -12.8), T(5.4, -4), T(-5.4, -4)], L.vest || MM.leather, 5.55, { g: grp('vest'), bevel: 2.5 });
    }
    // 帯
    C(T(-5.8, -3.2), T(5.9, -3.4), 1.25, 1.25, L.belt || MM.leatherDk, 5.7, { g: grp('belt') });
    if (!L.robe) Rc(T(2.3, -4.6)[0], T(2.3, -4.6)[1], 2.4, 2.6, L.metal || MM.gold, 5.75, { g: grp('buckle') });
    // 襟・マフラー
    if (L.scarf) {
      const gsf = grp('scarf');
      E(neck[0] + 0.4, neck[1] + 1.2, 4.8, 2.8, L.scarf, 6.1, { g: gsf, rot: lean });
      S([T(-2.5, -12.5), T(-7 - p.cape * 3, -9), T(-9 - p.cape * 5, -4)], 1.8, 0.9, L.scarf, 0.8, { g: gsf });
    } else E(neck[0] + 0.4, neck[1] + 0.8, 4.2, 2.3, L.trim, 6, { g: grp('collar'), rot: lean });

    // --- 奥の腕
    const arm = (side, a, e, z) => {
      const sh = T(side > 0 ? -2.4 : 2.6, side > 0 ? -10.8 : -11.8);
      const el = add(sh, [dir(a)[0] * 5.6, dir(a)[1] * 5.6]);
      const wr = add(el, [dir(a + e)[0] * 5.0, dir(a + e)[1] * 5.0]);
      const ga = grp('arm' + side), gg = grp('glove' + side);
      const sleeve = L.sleeve || L.top, glove = L.robe || L.bareArms ? sleeve : (L.glove || boots);
      C(sh, el, 2.35 * bw, 2.0 * bw, sleeve, z, { g: ga });
      C(el, wr, 2.0 * bw, 1.75, glove, z + 0.02, { g: gg });
      if (!L.robe && !L.bareArms) E(el[0], el[1], 2.3, 1.5, glove, z + 0.03, { g: gg, rot: a + e + PI / 2 });
      const hd = add(wr, [dir(a + e)[0] * 1.2, dir(a + e)[1] * 1.2]);
      E(hd[0], hd[1], 2.1, 2.1, L.robe || L.bareArms ? SK : glove, z + 0.05, { g: grp('hand' + side) });
      if (L.pauldron) E(sh[0] + (side > 0 ? -0.2 : 0.3), sh[1] + 0.25, 3.3, 2.8, L.metal, z + 0.1, { g: grp('pauld' + side), rot: lean });
      return hd;
    };
    const hF = arm(-1, p.aF, p.eF, 1);

    // --- 頭
    const gh = grp('head');
    const headFrom = out.length;
    C(neck, add(neck, rot([0.6, -3], headAng)), 1.8, 1.8, SK, 5.8, { g: grp('neck') });
    E(hc[0], hc[1], 11.2, 10.4, SK, 10, { g: gh, rot: headAng, bulge: 0.9 });
    E(H(4.5, 3.8)[0], H(4.5, 3.8)[1], 6.2, 5.4, SK, 10.01, { g: gh });
    face(L, H, p, E, C, Rc, grp, MM, SK);
    const ctx = { L, H, ha: headAng, grp, E, C, S, Pl, F, R: Rc, p, M: MM, SK, z0: 10.4 };
    if (rig.hair) rig.hair.draw(ctx);
    if (rig.headwear) rig.headwear.draw(ctx);
    // 頭の大きさ（2.7 頭身。STYLE.headScale）。頭・顔・髪の部品を首へ向けて縮める
    const hs = L.headScale != null ? L.headScale : ((R.Hd.STYLE && R.Hd.STYLE.headScale) || 0.88);
    if (hs !== 1) {
      const pv = add(neck, rot([0.4, -1.2], headAng));
      const sp = (q) => [pv[0] + (q[0] - pv[0]) * hs, pv[1] + (q[1] - pv[1]) * hs];
      for (let i = headFrom; i < out.length; i++) {
        const s = out[i];
        if (s[0] === 'e') { s[1] = sp(s[1]); s[2] *= hs; s[3] *= hs; }
        else if (s[0] === 'c') { s[1] = sp(s[1]); s[2] = sp(s[2]); s[3] *= hs; s[4] *= hs; }
        else if (s[0] === 'p') { s[1] = s[1].map(sp); if (s[4].bevel) s[4] = Object.assign({}, s[4], { bevel: s[4].bevel * hs }); }
        else if (s[0] === 'r') { s[1] = sp(s[1]); s[2] *= hs; s[3] *= hs; }
        else if (s[0] === 's') { s[1] = s[1].map(sp); s[2] *= hs; s[3] *= hs; }
        else if (s[0] === 'f') { s[1] = sp(s[1]); s[2] = sp(s[2]); s[3] *= hs; }
      }
    }
    const headC = hs !== 1 ? (() => { const pv = add(neck, rot([0.4, -1.2], headAng)); return [pv[0] + (hc[0] - pv[0]) * hs, pv[1] + (hc[1] - pv[1]) * hs]; })() : hc;

    // --- 手前の腕と武器
    const hN = arm(1, p.aN, p.eN, 11);
    if (!opt.noWeapon && rig.weapons && L.weapon) rig.weapons.draw(Object.assign(ctx, { hand: hN, handF: hF, wtype: L.weapon }));

    // --- 仕上げ: 全体の変換と足元の接地
    const tf = (q) => Gt(q[0], q[1]);
    let maxY = -1e9;
    const recordY = (q) => { const t = tf(q); if (t[1] > maxY) maxY = t[1]; };
    [aF, aN].forEach((a) => { recordY([a[0], a[1] + 2]); recordY([a[0] + 4, a[1] + 2]); });
    knees.forEach((k) => recordY([k[0], k[1] + 2.4]));
    if (p.rot) out.forEach((s) => { if (s[0] === 'c' || s[0] === 'e') recordY(s[1]); });
    const dy = p.air ? 0 : -maxY + (p.rot ? -1.2 : 0);
    const W = (q) => { const t = tf(q); return [t[0], t[1] + dy]; };
    for (const s of out) {
      const t = s[0];
      if (t === 'e') { const q = W(s[1]); B.ell(q[0], q[1], s[2], s[3], s[4], s[5], Object.assign({}, s[6], { rot: (s[6].rot || 0) + p.rot })); }
      else if (t === 'c') { const a = W(s[1]), b = W(s[2]); B.cap(a[0], a[1], b[0], b[1], s[3], s[4], s[5], s[6], s[7]); }
      else if (t === 'p') B.poly(s[1].map(W), s[2], s[3], s[4]);
      else if (t === 'r') {
        if (p.rot) { const x = s[1][0], y = s[1][1], w = s[2], h = s[3]; B.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(W), s[4], s[5], Object.assign({ bevel: 0.01 }, s[6])); }
        else { const q = W(s[1]); B.rect(q[0], q[1], s[2], s[3], s[4], s[5], s[6]); }
      } else if (t === 's') B.strand(s[1].map(W), s[2], s[3], s[4], s[5], s[6]);
      else if (t === 'f') { const a = W(s[1]), b = W(s[2]); B.fold(a[0], a[1], b[0], b[1], s[3], s[4], s[5]); }
    }
    return { hand: W(hN), handF: W(hF), head: W(headC), neck: W(neck), dy, headR: 11 * hs };
  };

  /** 顔（目・眉・口・頬）。表情は p.eyes（開き）・p.sq（細め）・p.mouth（0 閉 1 開 2 笑）・p.brow（+1 怒り −1 困り）・p.mouthDown */
  function face(L, H, p, E, C, Rc, grp, MM, SK) {
    const blink = p.eyes;
    const eyeM = L.eye || MM.lash;
    const eye = (ex, w, far) => {
      const [x, y] = H(ex, 0.4);
      if (blink < 0.25) { Rc(x - 0.2, y + 2.2, w + 0.6, 1, MM.lash, 10.6); return; }
      if (p.happy) {   // 笑った目（下向きの弧）
        C([x - 0.2, y + 2.6], [x + w * 0.5, y + 1.3], 0.55, 0.55, MM.lash, 10.62); C([x + w * 0.5, y + 1.3], [x + w + 0.2, y + 2.6], 0.55, 0.55, MM.lash, 10.62);
        return;
      }
      const h = 4.6 * Math.min(1.25, blink + 0.2) - p.sq * 1.8;
      Rc(x - 0.4, y + 3.6 - h - 0.9, w + (far ? 0.4 : 1.0), 1.1 + (L.fem ? 0.3 : 0), MM.lash, 10.62);
      Rc(x, y + 3.6 - h, w, h, eyeM, 10.6, { shade: 1 });
      Rc(x, y + 3.6 - h * 0.45, w, h * 0.45, eyeM, 10.61, { shade: 2 });
      if (h > 2) Rc(x + w - 1.1, y + 3.6 - h + 0.2, 1, 1, MM.white, 10.63);
    };
    eye(1.4, 2.8, false); eye(7.8, 1.9, true);
    // 眉（表情で傾ける）
    const b = p.brow || 0, lift = p.browUp || 0;
    const browM = L.browM || L.hair || MM.lash;
    C(H(0.9, -1.4 - lift - b * 0.9), H(4.5, -1.6 - lift + b * 0.9), 0.55, 0.55, browM, 10.64, { g: grp('brow1') });
    C(H(7.0, -1.4 - lift + b * 0.7), H(9.6, -1.6 - lift - b * 0.4), 0.5, 0.5, browM, 10.64, { g: grp('brow2') });
    // 口
    if (p.mouth === 1) Rc(H(6.0, 5.9)[0], H(6.0, 5.9)[1], 1.8, 1.9, MM.mouth, 10.6, { shade: 0 });
    else if (p.mouth === 2) { Rc(H(5.2, 6.0)[0], H(5.2, 6.0)[1], 2.8, 1.4, MM.mouth, 10.6, { shade: 0 }); Rc(H(5.4, 6.0)[0], H(5.4, 6.0)[1], 2.2, 0.6, MM.white, 10.61); }
    else if (p.mouthDown) Rc(H(5.6, 6.9)[0], H(5.6, 6.9)[1], 1.8, 0.6, MM.mouth, 10.6, { shade: 0 });
    else Rc(H(5.8, 6.6)[0], H(5.8, 6.6)[1], 1.6, 0.7, MM.mouth, 10.6, { shade: 0 });
    if (!L.old) Rc(H(1.2, 4.6)[0], H(1.2, 4.6)[1], 2.2, 0.9, MM.blush, 10.59);
    Rc(H(6.4, 4.2)[0], H(6.4, 4.2)[1], 0.9, 0.9, SK, 10.58, { shadeOff: -2 });
    if (L.old) { C(H(0.5, 3.4), H(3.0, 4.2), 0.3, 0.3, SK, 10.595, { shadeOff: -2 }); }
    // 耳（人の耳は髪の下。森の民は髪から出る）
    if (L.ears === 'elf') C(H(-3, 2.6), H(-10.6, -0.8), 1.45, 0.3, SK, L.hood ? 11.05 : 10.28, { g: grp('ear') });
    else if (L.hairStyle === 'bald' || L.ears === 'show') E(H(-1.2, 2.6)[0], H(-1.2, 2.6)[1], 1.3, 1.8, SK, 10.15, { g: grp('ear') });
    // 小物（ひげ・眼帯・眼鏡）
    const ex = L.extras || [];
    const hairM = L.hair || MM.lash;
    if (ex.includes('beard')) { const gb = grp('beard'); E(H(4.2, 7.4)[0], H(4.2, 7.4)[1], 6.4, 4.2, L.beardM || hairM, 10.66, { g: gb }); E(H(1.0, 5.0)[0], H(1.0, 5.0)[1], 3, 3.6, L.beardM || hairM, 10.65, { g: gb }); }
    if (ex.includes('beard') || ex.includes('mustache')) C(H(3.8, 5.2), H(8.6, 5.4), 0.9, 0.6, L.beardM || hairM, 10.67, { g: grp('stache') });
    if (ex.includes('eyepatch')) { E(H(2.8, 2.2)[0], H(2.8, 2.2)[1], 2.3, 2.2, MM.leatherDk, 10.7, { g: grp('patch') }); C(H(-9, -3), H(10, -0.5), 0.35, 0.35, MM.leatherDk, 10.69, { g: grp('strap') }); }
    if (ex.includes('glasses')) { const gg = grp('glasses'); C(H(0.6, 2.6), H(4.6, 2.6), 0.45, 0.45, MM.gold, 10.7, { g: gg }); C(H(7.2, 2.6), H(9.6, 2.6), 0.4, 0.4, MM.gold, 10.7, { g: gg }); C(H(-3, 1.6), H(0.6, 2.4), 0.3, 0.3, MM.gold, 10.7, { g: gg }); }
  }
})(window.RPG);
