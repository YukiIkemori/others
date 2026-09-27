// BSCENE: 戦闘の配置（MODERN_UI §2.3 の表。16:9 は 960 幅の値を中央に置き、幅が広い画面は真ん中の絵が広がる。
// 縦持ちは上の約 55% を戦場、その下に人の札・行動の札）。人と敵の足もとの座標（論理 px）を決める。
(function (R) {
  'use strict';
  const Bt = (R.Battle = R.Battle || {});
  const _ = (Bt._ = Bt._ || {});

  // 16:9（960×540 の見本の値）。味方は 前列 (575,338)・(616,395)、後列 (668,361)・(726,425)
  const WIDE = {
    front: [[575, 338], [616, 395], [590, 372], [560, 412]],
    back: [[668, 361], [726, 425], [700, 392], [742, 350]],
    // 敵の足もと（x 40〜420、y 320〜460）: 味方に近い列から
    foes: [[300, 395], [165, 342], [190, 452], [330, 470], [330, 330], [60, 395], [55, 468], [60, 330]],
    boss: [255, 410], bossAdds: [[380, 368], [392, 468], [70, 360], [70, 470]],
    lantern: [505, 385], horizon: 236,
  };
  // 縦持ち（540 幅。戦場は上の 0〜stageH）。見本 battle_tall.png の値を論理 px にした物
  const TALL = {
    front: [[330, 402], [352, 462], [340, 432], [322, 488]],
    back: [[410, 424], [440, 490], [425, 455], [452, 400]],
    foes: [[190, 438], [85, 400], [100, 505], [205, 515], [210, 385], [30, 452], [35, 520], [35, 385]],
    boss: [140, 462], bossAdds: [[245, 420], [250, 520], [40, 410], [40, 525]],
    lantern: [268, 450], horizon: 250,
  };

  const Lay = (_.layout = {});
  /** 今の R.W×R.H の配置 → {tall, ox, oy, stageH, cardsY, cmdY, chipsY, lantern, horizon, P(x,y)} */
  Lay.compute = function () {
    const tall = R.layout === 'tall';
    const k = R.uiScale || 1;
    if (tall) {
      const stageH = Math.min(Math.round(R.H * 0.52), 640);
      const oy = Math.round((stageH - 600) * 0.6);
      const cardsY = stageH - 20 * k;
      return {
        tall, ox: Math.round((R.W - 540) / 2), oy, stageH, cardsY,
        cmdY: cardsY + 2 * (64 + 8) * k + 26 * k, chipsY: R.H - (R.safe.b || 0) - 52 * k,
        T: TALL, lantern: [TALL.lantern[0] + (R.W - 540) / 2, TALL.lantern[1] + oy], horizon: TALL.horizon + oy,
      };
    }
    const ox = Math.round((R.W - 960) / 2), oy = Math.round((R.H - 540) / 2);
    return { tall, ox, oy, stageH: R.H, T: WIDE, lantern: [WIDE.lantern[0] + ox, WIDE.lantern[1] + oy], horizon: WIDE.horizon + oy };
  };

  function big(u) { return u.boss || u.size === 'l' || u.size === 'boss'; }

  /**
   * 味方の足もと（2026-09-27 の持ち主の報告「並びを変えた後の戦闘で位置と札の順が合わない」）:
   * 上から下へ隊列の順（R.Party の並び＝右上の札と同じ順）に並べ、前列・後列は横の一歩（後列は右へ）で分ける。
   * 以前は前列・後列ごとに場所を取っていたので、前・前・後・後 の並びでも見た目は 前→後→前→後 の順になっていた。
   * units は隊列の順で渡す（scene.js の place が st.partyUnits() の順にする）。
   */
  const PARTY = {
    wide: { y0: 332, y1: 448, x0: 578, slope: 0.62, back: 88 },
    tall: { y0: 396, y1: 500, x0: 330, slope: 0.35, back: 76 },
  };
  Lay.PARTY = PARTY;
  Lay.partySpots = function (L, units) {
    const P = L.tall ? PARTY.tall : PARTY.wide, out = {};
    const n = units.length;
    units.forEach((u, i) => {
      const y = n <= 1 ? (P.y0 + P.y1) / 2 : P.y0 + (P.y1 - P.y0) * (Math.min(n, 4) === n ? i / (n - 1) : i / 3);
      const x = P.x0 + (y - P.y0) * P.slope + (u.row === 'back' ? P.back : 0);
      out[u.uid] = { x: Math.round(x) + L.ox, y: Math.round(y) + L.oy };
    });
    return out;
  };

  /** 敵の足もと。大きい物（ボス・size l）を先に良い場所へ。ボスは敵側の真ん中（2 体以上は真ん中から左右に並べる） */
  Lay.enemySpots = function (L, units) {
    const T = L.T, out = {};
    const bosses = units.filter((u) => u.boss);
    const rest = units.filter((u) => !u.boss).slice().sort((a, b) => (big(b) ? 1 : 0) - (big(a) ? 1 : 0));
    if (bosses.length) {
      bosses.forEach((u, i) => { const d = i - (bosses.length - 1) / 2; out[u.uid] = { x: T.boss[0] + L.ox + d * 120, y: T.boss[1] + L.oy + Math.abs(d) * 20 }; });
      rest.forEach((u, i) => { const p = T.bossAdds[i % T.bossAdds.length]; out[u.uid] = { x: p[0] + L.ox, y: p[1] + L.oy + Math.floor(i / 4) * 6 }; });
      return out;
    }
    rest.forEach((u, i) => { const p = T.foes[i % T.foes.length]; out[u.uid] = { x: p[0] + L.ox + Math.floor(i / 8) * 12, y: p[1] + L.oy }; });
    return out;
  };

  /** 呼び出し（summon）で来た敵の空いた場所 */
  Lay.freeSpot = function (L, taken) {
    const T = L.T;
    for (const p of T.foes) {
      const x = p[0] + L.ox, y = p[1] + L.oy;
      if (!taken.some((q) => Math.abs(q.x - x) < 40 && Math.abs(q.y - y) < 30)) return { x, y };
    }
    return { x: T.foes[0][0] + L.ox - 20, y: T.foes[0][1] + L.oy + 10 };
  };

  /** 奥行きの係数（見本の scaleAt。影の長さ・濃さに使う） */
  Lay.depth = function (L, y) { return Math.max(0.6, Math.min(1.2, (y - L.horizon + 200) / 400)); };
})(window.RPG);
