// BEAST: ボス 根食らい（ヴェルダの森の地方ボス・千年樹。tr_b_rooteater）— hd:boss:boss_rooteater
// と、その子分の根（b_root）— hd:mon:b_root（V2_PLAN の名前）・hd:boss:boss_root・hd:mon:boss_root（魔物データの sprite 'boss_root'）
// 腐った根の塊。うろの中の大きな目 1 つが視線の的。影は赤紫へ（STYLE_REFERENCE §4.2）、腐れの紫の点と光る菌。
// 予告の構え tele: 「根が地面にもぐった……」— 地を這う根が土へもぐり、ひびが光り、体を低く構える（次の手番に前列へ根の全体攻撃）。
(function (R) {
  'use strict';
  const BZ = (R.Beast = R.Beast || {});
  const PI = Math.PI;
  const S = Math.sin, C = Math.cos;

  const PAL = {
    bark: { keys: ['#1a0e22', '#34182e', '#522a38', '#744640', '#96684e', '#b88c66'], n: 7, wrap: 0.25, amb: 0.14, tex: 2.6, tsx: 0.3, tsy: 1.2 },
    barkDk: { keys: ['#140a1c', '#28142a', '#402234', '#5c3a3c', '#7a5848'], n: 6, wrap: 0.25, amb: 0.12, tex: 2.4, tsx: 0.3, tsy: 1.2 },
    rot: { keys: ['#1c0c2a', '#3a1a4a', '#5e2e6a', '#8a4e8a', '#b47aa8'], n: 6, wrap: 0.4, amb: 0.2, tex: 2, tsx: 0.8, tsy: 0.8 },
    maw: { keys: ['#10060e', '#260a18', '#40121e', '#5e1c24'], n: 5, fixed: true },
    tooth: { keys: ['#4a3a3a', '#8a7a64', '#c4b490', '#ece0c0'], n: 5, wrap: 0.35 },
    moss: { keys: ['#142018', '#24402a', '#3e6a34', '#6a9a44', '#a4c868'], n: 6, tex: 2.5, tsx: 0.8, tsy: 0.8 },
    shroom: { keys: ['#2a0e1e', '#6a2430', '#b0503c', '#e08a54', '#f8c08a'], n: 6, wrap: 0.4, amb: 0.2 },
    glow: { keys: ['#9a50e0', '#f0c0ff'], n: 2, flat: true, glow: '#d090ff', fixed: true, noGold: true },
    crack: { keys: ['#e07030', '#ffe0a0'], n: 2, flat: true, glow: '#ffb060', fixed: true, noGold: true },
    sclera: { keys: ['#6a5a20', '#c0a840', '#f0e080'], n: 4, wrap: 0.6, amb: 0.4, glow: '#f0d860', fixed: true, noGold: true },
    iris: { keys: ['#6a0818', '#c01830', '#f04040', '#ff9a70'], n: 4, spec: 1, specPow: 4, fixed: true, noGold: true },
    pupil: { keys: ['#140810', '#2a0e1a'], n: 2, flat: true, fixed: true, noGold: true },
    white: { keys: ['#fffdf6', '#fffdf6'], n: 2, flat: true, fixed: true, noGold: true },
    soil: { keys: ['#160e1a', '#2a1c26', '#443030', '#5e4838'], n: 5, wrap: 0.3, tex: 2, tsx: 1, tsy: 1 },
  };
  /** うろの中の目（視線の的）。hit で閉じる */
  function eye(B, P, x, y, r, st, z) {
    B.ell(x, y + r * 0.1, r * 1.45, r * 1.25, P.barkDk, z - 0.05, { g: B.group(), bulge: 0.7 });
    if ((st.hit || 0) > 0.5) { B.cap(x - r, y, x + r, y + r * 0.2, r * 0.18, r * 0.18, P.pupil, z); return; }
    B.ell(x, y, r, r * 0.82, P.sclera, z);
    const lx = x + r * 0.2 + (st.atk || 0) * r * 0.1;
    B.ell(lx, y, r * 0.52, r * 0.6, P.iris, z + 0.01);
    B.ell(lx + r * 0.05, y, r * (st.tele ? 0.1 : 0.17), r * 0.45, P.pupil, z + 0.02);
    B.rect(lx - r * 0.35, y - r * 0.45, 1, 1, P.white, z + 0.03);
  }

  const boss = {
    tier: 'boss', at: 0.8, h: 104,
    pal: PAL,
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0, tele = st.tele || 0;
      const X = atk * 8 - hit * 5, dip = tele * 7 - br * 1 + hit * 2;
      const b = (x, y) => [X + x, y + dip * (1 - Math.min(1, -y / 110) * 0.2)];
      const Rr = BZ.rz().rng(31);
      // 地を這う根（予告の間は土へもぐる）
      const roots = [[-40, 0.1], [-28, 0.2], [-14, 0.3], [30, 0.1], [42, 0.2], [18, 0.4]];
      roots.forEach(([fx, k], i) => {
        const len = tele ? 0.45 : 1;
        const s0 = b(fx * 0.25, -22), end = [X + fx * len + (fx > 0 ? atk * 6 : 0), -1];
        B.strand([s0, [s0[0] + (end[0] - s0[0]) * 0.4, -18 + k * 10], [end[0] - (fx > 0 ? 5 : -5), -4], end], 6 - i * 0.3, 1.6, i % 2 ? P.barkDk : P.bark, i < 3 ? 0.3 + i * 0.01 : 1.6 + i * 0.01, { seg: 8 });
        if (tele) {
          B.ell(end[0], -1.2, 5, 1.8, P.soil, 1.7 + i * 0.01, { bulge: 0.5 });
          B.cap(end[0] - 4, -0.6, end[0] + 5 + (fx > 0 ? 8 : -8), -0.3, 0.5, 0.4, P.crack, 1.72 + i * 0.01, { noAO: true });
        }
      });
      // 枯れた枝の冠（奥）
      [[-18, -92, -40, -112, -52, -104], [-6, -98, -10, -122, 4, -126], [8, -94, 22, -114, 34, -110]].forEach(([x0, y0, x1, y1, x2, y2], i) => {
        const a = b(x0, y0 + 14);
        B.strand([a, b(x0, y0), b(x1, y1 + 10), b(x2, y2 + 12)], 3.6, 0.8, P.barkDk, 0.5 + i * 0.01, { seg: 7 });
        B.strand([b((x0 + x1) / 2, (y0 + y1) / 2 + 6), b((x0 + x1) / 2 + (i - 1) * 4, (y0 + y1) / 2), b((x0 + x1) / 2 + (i - 1) * 8, (y0 + y1) / 2 - 6)], 1.6, 0.5, P.barkDk, 0.51 + i * 0.01, { seg: 3 });
      });
      // 体（こぶの塊）
      const gb = B.group();
      [[0, -44, 30, 34, 0], [-14, -30, 20, 20, 0.2], [10, -70, 22, 20, -0.2], [-12, -74, 18, 16, 0.3], [16, -30, 18, 18, -0.1]].forEach(([x, y, rx, ry, rot], i) => B.ell(...b(x, y), rx, ry, i === 0 ? P.bark : (i % 2 ? P.barkDk : P.bark), 1 + i * 0.01, { g: gb, rot, bulge: 0.85 }));
      for (let i = 0; i < 7; i++) { const x = -24 + i * 8; B.fold(...b(x, -14), ...b(x + (i % 2 ? 4 : -4), -80), 0.9, gb, -2); }
      // 腐れの紫と光る点
      [[-18, -52, 9, 6], [-4, -24, 7, 4], [-22, -80, 6, 4]].forEach(([x, y, rx, ry], i) => B.ell(...b(x, y), rx, ry, P.rot, 1.2 + i * 0.01, { bulge: 0.5, noAO: true }));
      for (let i = 0; i < 9; i++) { const q = b(-26 + Rr() * 30, -86 + Rr() * 66); B.rect(q[0], q[1], 1, 1, P.glow, 1.3); }
      // 苔と棚のきのこ
      B.ell(...b(-6, -90), 16, 5, P.moss, 1.25, { bulge: 0.6, rot: -0.1 });
      B.ell(...b(-28, -40), 6, 9, P.moss, 1.26, { bulge: 0.6, rot: 0.3 });
      [[-24, -60, 6], [-28, -52, 4.5], [22, -82, 5]].forEach(([x, y, r], i) => { const q = b(x, y); B.ell(q[0], q[1], r, r * 0.45, P.shroom, 1.4 + i * 0.01, { bulge: 0.6, rot: x < 0 ? 0.2 : -0.2 }); });
      // 口（右の前）と歯
      const mo = b(17 + atk * 3, -40);
      const op = 0.45 + atk * 0.6 + tele * 0.2 - hit * 0.25;
      B.ell(mo[0], mo[1], 12 + atk * 2, 9 + op * 8, P.maw, 1.5);
      for (let k = 0; k < 7; k++) {
        const a = -PI * 0.85 + k * 0.28, rx = 12 + atk * 2, ry = 9 + op * 8;
        const ex = mo[0] + C(a) * rx, ey = mo[1] + S(a) * ry;
        B.poly([[ex - 2, ey - 0.5], [ex + 2, ey - 0.5], [mo[0] + C(a) * rx * 0.55, mo[1] + S(a) * ry * 0.45]], P.tooth, 1.55 + k * 0.001, { bevel: 0.6, noAO: true });
        const bx = mo[0] + C(-a) * rx, by = mo[1] + S(-a) * ry;
        B.poly([[bx - 2, by + 0.5], [bx + 2, by + 0.5], [mo[0] + C(-a) * rx * 0.55, mo[1] + S(-a) * ry * 0.45]], P.tooth, 1.55 + k * 0.001, { bevel: 0.6, noAO: true });
      }
      // 手前の枝の腕（根の爪）
      const sh = b(20, -58), el = [sh[0] + 14 + atk * 10, sh[1] + 8 - atk * 6 + hit * 6], cl = [el[0] + 10 + atk * 8, el[1] + 16 - atk * 6];
      B.strand([sh, el, cl], 6, 2.5, P.bark, 1.8, { seg: 7 });
      [[4, 5], [6, 1], [1, 7]].forEach(([dx, dy]) => B.strand([cl, [cl[0] + dx * 0.6, cl[1] + dy * 0.5], [cl[0] + dx, cl[1] + dy + 2]], 1.8, 0.5, P.barkDk, 1.81, { seg: 3 }));
      // 大きな目（視線の的）
      const ey = b(9, -68);
      eye(B, P, ey[0], ey[1], 8, st, 2.2);
      return { head: [ey[0], ey[1]], center: b(0, -46), fx: b(8, -46), eye: ey, eyes: [[ey[0], ey[1], 6]], mouth: mo, top: b(0, -100), body: [X, -46, 30, 34], u: 2, z: 2.3 };
    },
  };

  // 根の子分（add）: 土から伸びた根の触手。先に小さな目ととげ
  const root = {
    tier: 'add', at: 0.45, h: 56,
    pal: PAL,
    draw(B, P, st) {
      const br = S(st.t * PI * 2), atk = st.atk || 0, hit = st.hit || 0, tele = st.tele || 0;
      const sink = tele * 18;
      const sw = br * 3 + atk * 12 - hit * 8;
      const pts = [[0, 0], [-4, -16 + sink * 0.5], [4 + sw * 0.5, -34 + sink], [10 + sw, -48 + sink + atk * 6]];
      B.ell(0, -1.5, 13, 3.6, P.soil, 0.5, { bulge: 0.5 });
      B.strand(pts, 7, 2.2, P.bark, 1, { seg: 12 });
      B.strand([[-3, -8 + sink * 0.3], [-10, -16 + sink * 0.4], [-14, -14 + sink * 0.4]], 2.4, 0.6, P.barkDk, 0.9, { seg: 4 });
      // とげ
      for (let k = 0; k < 6; k++) {
        const t = 0.25 + k * 0.12, i = Math.min(2, Math.floor(t * 3)), f = t * 3 - i;
        const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f, s = k % 2 ? 1 : -1;
        B.poly([[x - 1.2, y], [x + s * 5, y - 2.5], [x + 1.2, y + 0.5]], P.tooth, 1.1 + k * 0.001, { bevel: 0.4, noAO: true });
      }
      B.ell(...[pts[2][0] - 1, pts[2][1] + 6], 3.5, 2.2, P.rot, 1.05, { noAO: true });
      // 先（鉤）と目
      const tip = pts[3];
      B.strand([tip, [tip[0] + 6, tip[1] - 3], [tip[0] + 9, tip[1] + 3]], 3.2, 0.6, P.barkDk, 1.2, { seg: 5 });
      eye(B, P, tip[0] - 0.5, tip[1] + 1.5, 3.2, st, 1.4);
      if (tele) { B.cap(-10, -0.8, 12, -0.4, 0.5, 0.4, P.crack, 1.5, { noAO: true }); }
      return { head: [tip[0], tip[1]], center: [pts[1][0] + 2, pts[1][1] - 6], fx: [pts[2][0], pts[2][1]], eye: [tip[0] - 0.5, tip[1] + 1.5], eyes: [[tip[0] - 0.5, tip[1] + 1.5, 2.5]], top: [tip[0] + 6, tip[1] - 4], body: [0, -24, 6, 24], u: 1.2, z: 1.6 };
    },
  };

  (BZ._bossDefs = BZ._bossDefs || []).push(['boss_rooteater', boss]);
  (BZ._bossDefs = BZ._bossDefs || []).push(['b_root', root, ['hd:mon:b_root', 'hd:boss:boss_root', 'hd:mon:boss_root']]);
})(window.RPG);
